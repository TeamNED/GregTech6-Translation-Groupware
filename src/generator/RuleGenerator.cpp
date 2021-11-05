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
      // remove invalid results
      sub_result.erase(
          std::remove_if(sub_result.begin(), sub_result.end(),
                         [](const shared_ptr<ILangResult> &r) -> bool {
                           return r->empty();
                         }),
          sub_result.end());
      if (sub_result.empty()) {
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
      // generate RuleLangResult
      vector<shared_ptr<ILangResult>> lang_conbination;
      for (auto &begin : begins) {
        lang_conbination.push_back(std::move(*begin));
      }
      auto generated_result =
          std::make_shared<RuleLangResult>(meta(), rule, lang_conbination);
      auto generated_meta = generated_result->meta_conbined();
      if (generated_meta) {
        // check meta cache
        auto meta_cached = std::find_if(
            meta_cache.cbegin(), meta_cache.cend(),
            [&, generated_meta](const shared_ptr<IGeneratorMeta> that) -> bool {
              const IGeneratorMeta &that_ref = *that;
              return (*generated_meta) == that_ref;
            });
        if (meta_cached != meta_cache.end()) {
          generated_meta = *meta_cached;
        } else {
          meta_cache.push_back(generated_meta);
        }
        generated_result->meta() = std::move(generated_meta);
        results.push_back(std::move(generated_result));
      }
      // step
      for (size_t i = subs_sz; i > 0; --i) {
        if (++begins[i - 1] == sub_results[i - 1].cend()) {
          begins.pop_back();
        } else {
          break;
        }
      }
    } while (begins.size() > 0);
  }
  return results;
}