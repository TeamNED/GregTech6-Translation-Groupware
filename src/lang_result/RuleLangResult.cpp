#include "RuleLangResult.hpp"

RuleLangResult::RuleLangResult(shared_ptr<IGeneratorMeta> meta,
                               shared_ptr<Rule> rule,
                               vector<shared_ptr<ILangResult>> subs)
    : LangResult(meta), _rule(rule), _subs(subs) {}

shared_ptr<Rule> &RuleLangResult::rule() { return this->_rule; }
vector<shared_ptr<ILangResult>> &RuleLangResult::subs() { return this->_subs; }

pkvlist RuleLangResult::result() { return result(true); };
pkvlist RuleLangResult::result(bool cached) {
  if (cached) {
    if (this->_result == nullptr) {
      this->_result = _generate();
    }
    return this->_result;
  } else {
    return _generate();
  }
};

pkvlist RuleLangResult::_generate() {}
