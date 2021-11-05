#include "RuleGenerator.hpp"

RuleGenerator::RuleGenerator(shared_ptr<IGeneratorMeta> meta)
    : Generator(std::move(meta)) {}
RuleGenerator::RuleGenerator(shared_ptr<IGeneratorMeta> meta,
                             vector<shared_ptr<Rule>> rules)
    : Generator(std::move(meta)), _rules(std::move(rules)) {}
vector<shared_ptr<Rule>> &RuleGenerator::rules() { return this->_rules; }
const vector<shared_ptr<Rule>> &RuleGenerator::rules() const {
  return this->_rules;
}

vector<shared_ptr<ILangResult>>
RuleGenerator::results(IGroupRepository *repo) const {
  vector<shared_ptr<ILangResult>> results;
  if (repo == nullptr) {
    return results;
  }
  for (const auto &rule : _rules) {
    if (rule == nullptr) {
      continue;
    }
    const auto &subs = rule->subs();
    size_t subs_sz = subs.size();
    if (subs_sz == 0) {
      continue;
    }
    // init
    vector<vector<shared_ptr<ILangResult>>> sub_results; // data holder
    for (const auto &sub : subs) {
      auto sub_result = repo->get_group_results(sub);
      if (sub_result.size() == 0) {
        // zero-length group, not valid
        sub_results.clear();
        break;
      }
      sub_results.push_back(std::move(sub_result));
    }
    if (sub_results.size() == 0) {
      continue; // init failed, see clear() above
    }
    vector<vector<shared_ptr<ILangResult>>::const_iterator> begins{};
    vector<shared_ptr<IGeneratorMeta>> meta_cache{};
    do {
      // fill
      for (size_t i = begins.size(); i < subs_sz; ++i) {
        begins.push_back(sub_results[i].cbegin());
      }
      // generate conbination
      const IGeneratorMeta &meta_source = *meta();
      shared_ptr<GeneratorMeta> meta_conbination =
          std::make_shared<GeneratorMeta>(meta_source);
      vector<shared_ptr<ILangResult>> lang_conbination;
      for (auto &begin : begins) {
        *meta_conbination += *((*begin)->meta());
        if (meta_conbination->group().empty()) {
          break;
        }
        lang_conbination.push_back(std::move(*begin));
      }
      if (meta_conbination->group().empty()) {
        continue; // generate failed.
      }
      // check meta cache
      auto meta_cached = std::find_if(
          meta_cache.cbegin(), meta_cache.cend(),
          [&, meta_conbination](const shared_ptr<IGeneratorMeta> that) -> bool {
            const IGeneratorMeta &that_ref = *that;
            return (*meta_conbination) == that_ref;
          });
      shared_ptr<IGeneratorMeta> final_meta(std::move(meta_conbination));
      if (meta_cached != meta_cache.end()) {
        final_meta = *meta_cached;
      } else {
        meta_cache.push_back(final_meta);
      }
      // generate RuleLangResult
      auto generated_result =
          std::make_shared<RuleLangResult>(final_meta, rule, lang_conbination);
      results.push_back(std::move(generated_result));
      // step
      for (size_t i = subs_sz; i > 0; --i) {
        if (++begins[i - 1] == sub_results[i - 1].cend()) {
          begins.pop_back();
          sub_results.pop_back();
        } else {
          break;
        }
      }
    } while (begins.size() > 0);
  }
  return results;
}