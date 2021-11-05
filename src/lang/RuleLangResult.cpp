#include "RuleLangResult.hpp"

RuleLangResult::RuleLangResult(shared_ptr<IGeneratorMeta> meta,
                               shared_ptr<Rule> rule,
                               vector<shared_ptr<ILangResult>> subs)
    : LangResult(std::move(meta)), _rule(std::move(rule)),
      _subs(std::move(subs)) {}

shared_ptr<Rule> &RuleLangResult::rule() { return this->_rule; }
const shared_ptr<Rule> &RuleLangResult::rule() const { return this->_rule; }
vector<shared_ptr<ILangResult>> &RuleLangResult::subs() { return this->_subs; }
const vector<shared_ptr<ILangResult>> &RuleLangResult::subs() const {
  return this->_subs;
}

LangListPointer RuleLangResult::result() const { return result(true); };
LangListPointer RuleLangResult::result(bool cached) const {
  if (cached) {
    if (this->_result == nullptr) {
      this->_result = _generate();
    }
    return this->_result;
  } else {
    return _generate();
  }
};

LangListPointer RuleLangResult::_generate() const {
  size_t subs_sz = _subs.size();
  if (_rule == nullptr || subs_sz == 0) {
    return std::make_shared<LangList>();
  }
  // init
  vector<LangListPointer> sub_results{}; // data holder
  for (auto sub : _subs) {
    sub_results.push_back(sub->result());
  }
  vector<LangList::const_iterator> begins{};
  LangListPointer result = std::make_shared<LangList>();
  const string &s_fmt = _rule->source();
  const string &t_fmt = _rule->target();
  fmt::dynamic_format_arg_store<fmt::format_context> s_store, t_store;
  do {
    // fill zeros
    for (size_t i = begins.size(); i < subs_sz; ++i) {
      begins.push_back(sub_results[i]->cbegin());
    }
    // generate
    s_store.clear();
    t_store.clear();
    for (const auto &citor : begins) {
      s_store.push_back(citor->first);
      t_store.push_back(citor->second);
    }
    result->emplace_back(fmt::vformat(s_fmt, s_store),
                         fmt::vformat(t_fmt, t_store));
    // step
    for (size_t i = subs_sz; i > 0; --i) {
      if (++begins[i - 1] == sub_results[i - 1]->cend()) {
        begins.pop_back();
      } else {
        break;
      }
    }
  } while (begins.size() > 0);
  return result;
}
